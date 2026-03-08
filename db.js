const INSFORGE_API_BASE = 'https://iznwab88.us-east.insforge.app/api';

/**
 * Helper to fetch data with authentication if logged in
 */
async function apiFetch(endpoint, method = 'GET', body = null, isFormData = false) {
    const token = localStorage.getItem('auth_token');

    // For local dev without anon key set, we will rely on authenticated requests 
    // or public endpoints where RLS is off.
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // InsForge API requires Anon-Key for public access sometimes, ideally it's placed here.
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTEzODV9.Xv-dQLWzgoirFBpDAyyLzFq4Gn1rohv2oOnFOionhLE'; // Insert generated anon key
    if (!token && ANON_KEY) {
        headers['Authorization'] = `Bearer ${ANON_KEY}`;
    }

    if (!isFormData && body) {
        headers['Content-Type'] = 'application/json';
        if (method === 'POST' || method === 'PATCH') {
            headers['Prefer'] = 'return=representation';
        }
    }

    const options = { method, headers };
    if (body) {
        options.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${INSFORGE_API_BASE}${endpoint}`, options);

    // For delete/empty responses
    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const errorMessage = data?.message || data?.error || `API Error: ${res.status}`;

        // Handle token expiration specifically
        if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('jwt expired')) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_refresh');
            localStorage.removeItem('auth_user');
            throw new Error('Your session has expired. Please log in again to publish.');
        }

        throw new Error(errorMessage);
    }

    return data;
}

/** DATABASE API (Using PostgREST endpoints exposed by InsForge) **/

// Get all stories or articles
async function getStories(category = 'story') {
    return await apiFetch(`/database/records/stories?category=eq.${category}&select=*,profiles(name,avatar_url)&order=created_at.desc`);
}

// Get single story
async function getStory(id) {
    const data = await apiFetch(`/database/records/stories?id=eq.${id}&select=*,profiles(name,avatar_url)`);
    return data && data.length > 0 ? data[0] : null;
}

// Get comments for a story
async function getComments(storyId) {
    return await apiFetch(`/database/records/comments?story_id=eq.${storyId}&select=*,profiles(name,avatar_url)&order=created_at.desc`);
}

// Insert Story (Admin only)
async function createStory(storyData) {
    const user = getCurrentUser();
    if (!user) throw new Error("Not logged in");

    storyData.author_id = user.id;

    // Use Prefer: return=representation to get the inserted row back
    return await apiFetch('/database/records/stories', 'POST', [storyData]);
}

// Delete Story (Admin only)
async function deleteStory(id) {
    const user = getCurrentUser();
    if (!user || user.email !== 'admin@richasharma.com') throw new Error("Unauthorized to delete.");

    return await apiFetch(`/database/records/stories?id=eq.${id}`, 'DELETE');
}

// Insert Comment
async function addComment(storyId, content) {
    const user = getCurrentUser();
    if (!user) throw new Error("Not logged in");

    const commentData = {
        story_id: storyId,
        user_id: user.id,
        content: content
    };

    return await apiFetch('/database/records/comments', 'POST', [commentData]);
}


/** STORAGE API **/

// Upload an image (cover or inline)
async function uploadImage(file) {
    // We are using 'uploadAuto' approach via REST - InsForge Storage API
    // The endpoint format for buckets is /storage/buckets/{bucketName}/objects/{objectKey}
    // But since Insforge uses a proxy for auto naming we can try generating a random key
    // The correct endpoint for uploadAuto is /storage/buckets/{bucketName}/objects
    const endpoint = `/storage/buckets/images/objects`;

    const formData = new FormData();
    formData.append('file', file);

    const data = await apiFetch(endpoint, 'POST', formData, true);

    // The structure returned is {data: {bucket, key, size, mimeType, uploadedAt, url}, error}
    if (data && data.url) {
        return { url: data.url, key: data.key };
    }

    if (data && data.data && data.data.url) {
        return { url: data.data.url, key: data.data.key };
    }

    throw new Error("Upload failed, could not parse URL.");
}
