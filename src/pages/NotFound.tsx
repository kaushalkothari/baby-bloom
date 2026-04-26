import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("notFound.title")}</p>
        <div className="flex flex-col gap-2 text-sm">
          <Link to="/" className="text-primary underline hover:text-primary/90">
            {t("notFound.returnHome")}
          </Link>
          <Link to="/login" className="text-muted-foreground underline hover:text-foreground">
            {t("notFound.logIn")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
