import api from "./api";

export const loginUser = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

export const updateUserLanguage = async (language) => {
  const response = await api.put("/auth/language", { language });
  return response.data;
};

