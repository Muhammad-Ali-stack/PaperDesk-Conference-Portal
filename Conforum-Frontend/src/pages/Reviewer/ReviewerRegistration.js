import React, { useState } from "react";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import Layout from "../../components/Layout";

const ReviewerRegistrationForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    expertise: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "/api/reviewer/register-reviewer",
        formData
      );
      if (response.data.success) {
        toast.success(response.data.message || "Registered successfully!");
        setFormData({ name: "", email: "", password: "", expertise: "" });
      } else {
        toast.error(response.data.message || "Registration failed!");
      }
    } catch (error) {
      toast.error("An error occurteal during registration.");
    }
  };

  return (
    <Layout title={"ConForum - Reviewer Registration"}>
      <div className="min-h-screen bg-white text-primary flex items-center justify-center">
        {/* Toast container */}
        <Toaster position="top-center" reverseOrder={false} />

        <div className="w-full max-w-md bg-gray-100 p-8 rounded-lg shadow-lg">
          <h1
            className="text-2xl font-bold text-center mb-6 text-primary"
          >
            Reviewer Registration
          </h1>

          <form className="space-y-4 " onSubmit={handleSubmit}>
            {/* Name Field */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-primaryAlt-dark"
              >
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primaryAlt-dark focus:outline-none border-secondaryAlt-dark  text-primary"
              />
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-primaryAlt-dark"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email address"
                className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primaryAlt-dark focus:outline-none border-secondaryAlt-dark  text-primary"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-primaryAlt-dark"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
                className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primaryAlt-dark focus:outline-none border-secondaryAlt-dark  text-primary"
              />
            </div>

            {/* Expertise Field */}
            <div>
              <label
                htmlFor="expertise"
                className="block text-sm font-medium text-primaryAlt-dark"
              >
                Expertise
              </label>
              <input
                type="text"
                id="expertise"
                name="expertise"
                value={formData.expertise}
                onChange={handleChange}
                placeholder="Enter your areas of expertise (comma-separated)"
                className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primaryAlt-dark focus:outline-none border-secondaryAlt-dark  text-primary"
              />
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                className="w-1/2 py-2 px-4 text-white rounded-md bg-primaryAlt-dark hover:bg-primaryAlt-light focus:outline-none focus:ring-2 focus:ring-primaryAlt-dark"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ReviewerRegistrationForm;
