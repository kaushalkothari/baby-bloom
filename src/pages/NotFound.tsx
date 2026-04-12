import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <div className="flex flex-col gap-2 text-sm">
          <Link to="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </Link>
          <Link to="/login" className="text-muted-foreground underline hover:text-foreground">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
