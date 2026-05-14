import React from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Home } from "lucide-react";

const Pagenotfound = () => {
  return (
    <Layout title="ConForum - Page Not Found">
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 text-center">
        <div className="animate-fade-in">
          <p className="text-8xl font-black text-primary/20 mb-4">404</p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Page not found</h1>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            The page you are looking for does not exist or has been moved.
          </p>
          <Button asChild size="lg">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Pagenotfound;
