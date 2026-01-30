import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import Logo from "../assets/Logo.jpeg";
import { API_URL } from "../config";

function SignUp() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values) {
  try {
    const { name, email, password } = values;

    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "Sign up failed");
    }

    alert("Account created successfully. Please sign in.");
    navigate("/signin", { replace: true });
  } catch (err) {
    alert(err?.message || "Sign up failed");
  }
}


  return (
    <div className="relative min-h-screen flex items-center justify-center bg-base-200 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-base-200 via-base-100 to-cyan-100 opacity-60 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[400px] h-[400px] bg-cyan-400/30 blur-[120px] rounded-full" />
      <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-blue-400/30 blur-[120px] rounded-full" />

      <div className="card w-full max-w-md bg-base-100/90 backdrop-blur-sm shadow-2xl border border-base-300 z-10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <img
            src={Logo}
            alt="Factory Logo"
            className="w-23 h-10 rounded-lg object-cover shadow-md"
          />
        </div>

        <div className="card-body p-0">
          <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
            Create Account
          </h2>
          <p className="text-center text-base-content/60 mb-6">
            Join the Factory Management System
          </p>

          <form
            className="space-y-4"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div>
              <label className="label">
                <span className="label-text font-medium">Full Name</span>
              </label>
              <input
                type="text"
                placeholder="Ahmed Reda"
                className={`input input-bordered w-full ${
                  errors.name ? "input-error" : ""
                }`}
                {...register("name", {
                  required: "Full name is required",
                  minLength: { value: 3, message: "Enter your full name" },
                })}
              />
              {errors.name && (
                <span className="text-error text-sm mt-1 inline-block">
                  {errors.name.message}
                </span>
              )}
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Email</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className={`input input-bordered w-full ${
                  errors.email ? "input-error" : ""
                }`}
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /[^\s@]+@[^\s@]+\.[^\s@]+/,
                    message: "Enter a valid email",
                  },
                })}
              />
              {errors.email && (
                <span className="text-error text-sm mt-1 inline-block">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Password</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`input input-bordered w-full ${
                  errors.password ? "input-error" : ""
                }`}
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
              />
              {errors.password && (
                <span className="text-error text-sm mt-1 inline-block">
                  {errors.password.message}
                </span>
              )}
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Confirm Password</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`input input-bordered w-full ${
                  errors.confirmPassword ? "input-error" : ""
                }`}
                {...register("confirmPassword", {
                  required: "Confirm your password",
                  validate: (value) =>
                    value === getValues("password") || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && (
                <span className="text-error text-sm mt-1 inline-block">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>

            <button
              disabled={isSubmitting}
              className="btn btn-primary w-full hover:scale-105 transition-transform shadow-lg hover:shadow-primary/50"
            >
              {isSubmitting ? "Creating..." : "Sign Up"}
            </button>

            <p className="text-center text-sm text-base-content/60 mt-4">
              Already have an account?{" "}
              <Link to="/signin" className="link link-primary">
                Sign In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
