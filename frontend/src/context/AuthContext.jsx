import React, { createContext, useContext, useState, useEffect } from "react";
import { loginUser } from "../services/authApi";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("retailmind_token");
      const storedUser = localStorage.getItem("retailmind_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Failed to parse stored auth session:", e);
      localStorage.removeItem("retailmind_token");
      localStorage.removeItem("retailmind_user");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("retailmind_token", data.token);
    localStorage.setItem("retailmind_user", JSON.stringify(data.user));
    if (data.user?.language) {
      localStorage.setItem("retailmind_language", data.user.language);
    }
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("retailmind_token");
    localStorage.removeItem("retailmind_user");
    localStorage.removeItem("retailmind_language");
    sessionStorage.removeItem("retailmind_active_lang");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
