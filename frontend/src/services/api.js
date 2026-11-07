const API_BASE_URL = "http://localhost:5000/api";

// ================= AUTH HEADERS =================

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

// ================= PLACE APIs =================

// GET all places
export const getPlaces = async () => {
  const response = await fetch(`${API_BASE_URL}/places`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch places");
  }

  return data;
};

// GET place by ID
export const getPlaceById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/places/${id}`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch destination details");
  }

  return data;
};

// CREATE a place
export const createPlace = async (placeData) => {
  const response = await fetch(`${API_BASE_URL}/places`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(placeData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to add destination");
  }

  return data;
};

// UPDATE a place
export const updatePlace = async (id, placeData) => {
  const response = await fetch(`${API_BASE_URL}/places/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(placeData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update destination");
  }

  return data;
};

// DELETE a place
export const deletePlace = async (id) => {
  const response = await fetch(`${API_BASE_URL}/places/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete destination");
  }

  return data;
};

// ================= USER APIs =================

// GET all users
export const getUsers = async () => {
  const response = await fetch(`${API_BASE_URL}/users`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch users");
  }

  return data;
};

// REGISTER user
export const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Registration failed");
  }

  return data;
};

// LOGIN user
export const loginUser = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  return data;
};

// ================= REVIEW APIs =================

// GET all reviews
export const getReviews = async () => {
  const response = await fetch(`${API_BASE_URL}/reviews`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch reviews");
  }

  return data;
};

// GET reviews for a destination
export const getReviewsByPlace = async (placeId) => {
  const response = await fetch(`${API_BASE_URL}/reviews/place/${placeId}`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch destination reviews");
  }

  return data;
};

// ADD a review
export const addReview = async (reviewData) => {
  const response = await fetch(`${API_BASE_URL}/reviews`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(reviewData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to add review");
  }

  return data;
};

// DELETE a review
export const deleteReview = async (id) => {
  const response = await fetch(`${API_BASE_URL}/reviews/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete review");
  }

  return data;
};

// ================= FAVORITE APIs =================

// GET favorites
export const getFavorites = async () => {
  const response = await fetch(`${API_BASE_URL}/favorites`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to load favorites");
  }

  return data;
};

// ADD favorite
export const addFavorite = async (placeId) => {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}/favorites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      place: placeId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to add favorite");
  }

  return data;
};

// REMOVE favorite
export const removeFavorite = async (favoriteId) => {
  const response = await fetch(
    `${API_BASE_URL}/favorites/${favoriteId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to remove favorite");
  }

  return data;
};

// ================= TRIP APIs =================

// GET all trips
export const getTrips = async () => {
  const response = await fetch(`${API_BASE_URL}/trips`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch trips");
  }

  return data;
};

// CREATE a trip
export const createTrip = async (tripData) => {
  const response = await fetch(`${API_BASE_URL}/trips`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(tripData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create trip");
  }

  return data;
};

// UPDATE a trip
export const updateTrip = async (id, tripData) => {
  const response = await fetch(`${API_BASE_URL}/trips/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(tripData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update trip");
  }

  return data;
};

// DELETE a trip
export const deleteTrip = async (id) => {
  const response = await fetch(`${API_BASE_URL}/trips/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete trip");
  }

  return data;
};

// ================= HIDDEN GEM APIs =================

// GET all approved hidden gems (public)
export const getHiddenGems = async () => {
  const response = await fetch(`${API_BASE_URL}/hidden-gems`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch hidden gems");
  }

  return data;
};

// GET current user's submitted hidden gems
export const getMyHiddenGems = async () => {
  const response = await fetch(`${API_BASE_URL}/hidden-gems/my-submissions`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch your submissions");
  }

  return data;
};

// SUBMIT a hidden gem
export const submitHiddenGem = async (gemData) => {
  const response = await fetch(`${API_BASE_URL}/hidden-gems`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(gemData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to submit hidden gem");
  }

  return data;
};

// ================= AI ASSISTANT APIs =================

// GET AI assistant status
export const getAIStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/ai/status`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch AI assistant status");
  }

  return data;
};

// CHAT with AI assistant (supports contextual destination guide & language)
export const chatWithAI = async (message, history = [], destinationContext = null, language = "en") => {
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, history, destinationContext, language }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to communicate with AI Assistant");
  }

  return data;
};

// ================= 3D HIDDEN GEM & PHOTO-TO-3D APIs =================

// SUBMIT a hidden gem with multiple photographs (multipart/form-data)
export const submitHiddenGemWithPhotos = async (formData) => {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Notice: Do NOT set Content-Type header when sending FormData;
  // the browser will automatically set it along with the multipart boundary.

  const response = await fetch(`${API_BASE_URL}/hidden-gems`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to submit hidden gem with photographs");
  }

  return data;
};

// GET 3D processing status of a hidden gem
export const getHiddenGemStatus = async (gemId) => {
  const response = await fetch(`${API_BASE_URL}/hidden-gems/${gemId}/status`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch 3D reconstruction status");
  }

  return data;
};

// RETRY failed 3D reconstruction
export const retryHiddenGemReconstruction = async (gemId) => {
  const response = await fetch(`${API_BASE_URL}/hidden-gems/${gemId}/retry`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to retry 3D reconstruction");
  }

  return data;
};

// ADMIN: Get all submissions (all statuses)
export const getAllHiddenGemsAdmin = async () => {
  const response = await fetch(`${API_BASE_URL}/hidden-gems/all`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Admin authorization required to fetch all gems");
  }

  return data;
};

// ADMIN: Approve or reject a submission and 3D model
export const updateHiddenGemStatusAdmin = async (gemId, statusData) => {
  const response = await fetch(`${API_BASE_URL}/hidden-gems/${gemId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(statusData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update review status");
  }

  return data;
};

// ================= DESTINATION DISCOVERY & GUIDE APIs =================

// SEARCH destinations (hybrid: local MongoDB + global Wikipedia)
export const searchDestinationsApi = async (query) => {
  const response = await fetch(`${API_BASE_URL}/destinations/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to search destinations");
  }

  return Array.isArray(data) ? data : [];
};

// GET rich destination travel dossier
export const getDestinationDetailsApi = async (queryOrSlug) => {
  const response = await fetch(`${API_BASE_URL}/destinations/details?q=${encodeURIComponent(queryOrSlug)}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Destination "${queryOrSlug}" could not be found.`);
  }

  return data;
};

// TRANSLATE travel guide text into target language
export const translateDestinationApi = async (text, targetLang) => {
  const response = await fetch(`${API_BASE_URL}/destinations/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, targetLang }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Translation failed");
  }

  return data;
};
