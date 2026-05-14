import React from "react";

const Layout = ({ children, title = "ConForum" }) => {
  React.useEffect(() => {
    document.title = title;
  }, [title]);

  return <>{children}</>;
};

export default Layout;
