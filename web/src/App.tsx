import { ScrollToTop } from "@/components/ScrollToTop";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";

export default function App() {
  const app = window.location.pathname === "/app" || window.location.pathname.startsWith("/app/");
  return (
    <>
      {app ? <Dashboard /> : <Home />}
      <ScrollToTop />
    </>
  );
}
