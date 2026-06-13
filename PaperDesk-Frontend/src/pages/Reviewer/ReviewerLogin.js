import React from "react";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/Auth";

const ReviewerLoginForm = () => {
  // Initialize the useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const [auth, setAuth] = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Function to handle form submission
  const onSubmit = async (data) => {
    try {
      const res = await axios.post("api/reviewer/login-reviewer", data);
      if (res.data.success) {
        toast.success(res.data.message);
        // Save the token or user data to localStorage or context
        localStorage.setItem("token", res.data.token);
        setAuth({
          ...auth,
          user: res.data.user,
          token: res.data.token,
        });
        localStorage.setItem("auth", JSON.stringify(res.data));
        navigate(location.state || "/");
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      toast.error("Something went wrong", {
        duration: 3000,
      });
    }
  };

  return (
    <Layout title={"PaperDesk - Login"}>
      <div className="min-h-screen bg-white text-primary flex items-center justify-center">
        {/* Toast container */}
        <div className="w-full max-w-md bg-gray-100 p-8 rounded-lg shadow-lg">
          <h1
            className="text-2xl font-bold text-center mb-6"
            style={{ color: "#5F6F52" }}
          >
            Reviewer Login
          </h1>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Field */}
            <div>
              <label
                className="block text-sm font-medium text-primaryAlt-dark"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                placeholder="Enter your email"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: "Invalid email address",
                  },
                })}
                className={`mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primaryAlt-dark focus:outline-none border-secondaryAlt-dark text-primary ${
                  errors.email ? "border-teal-500" : ""
                }`}
              />
              {errors.email && (
                <p className="text-teal-500 text-xs italic">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                className="block text-sm font-medium text-primaryAlt-dark"
                htmlFor="password"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
                className={`mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primaryAlt-dark focus:outline-none border-secondaryAlt-dark text-primary ${
                  errors.password ? "border-teal-500" : ""
                }`}
              />
              {errors.password && (
                <p className="text-teal-500 text-xs italic">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                className="w-1/2 py-2 px-4 text-white rounded-md bg-primaryAlt-dark hover:bg-primaryAlt-light focus:outline-none focus:ring-2 focus:ring-primaryAlt-dark"
              >
                Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ReviewerLoginForm;
