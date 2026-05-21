import React from "react";

const Layout = ({ children, title = "PaperDesk" }) => {
  React.useEffect(() => {
    document.title = title;
  }, [title]);

  return <>{children}</>;
};

export default Layout;
