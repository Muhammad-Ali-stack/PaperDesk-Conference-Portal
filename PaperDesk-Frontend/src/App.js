import React, { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import axios from "axios";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { OrganizerConferenceProvider } from "./context/OrganizerConferenceContext";
import UserPrivateRoute from "./routes/userAuth";
import DashboardLayout from "./components/DashboardLayout";

const Home                      = lazy(() => import("./pages/Home"));
const Pagenotfound              = lazy(() => import("./pages/Pagenotfound"));
const Login                     = lazy(() => import("./pages/Auth/Login"));
const Register                  = lazy(() => import("./pages/Auth/Register"));
const Forgotpassword            = lazy(() => import("./pages/Auth/Forgotpassword"));
const AllConferences            = lazy(() => import("./pages/Organizer/AllConferences"));
const ConferenceCreationForm    = lazy(() => import("./pages/Organizer/CreateConference"));
const UserDashboard             = lazy(() => import("./pages/Auth/UserDashboard"));
const UserProfile               = lazy(() => import("./components/UserProfile"));
const RolesPage                 = lazy(() => import("./pages/Auth/Roles"));
const ConferencePapers          = lazy(() => import("./pages/Organizer/ConferenceSubmissions"));
const ConferenceDetailsPage     = lazy(() => import("./pages/conference/ConferenceDetails"));
const PaperSubmissionDetails    = lazy(() => import("./pages/Author/PaperSubmissondetails"));
const OrganizerDashboard        = lazy(() => import("./pages/Organizer/OrganizerDashboard"));
const AuthorDashboard           = lazy(() => import("./pages/Author/AuthorDashboard"));
const ReviewerDashboard         = lazy(() => import("./pages/Reviewer/ReviewerDashboard"));
const ThankYouPage              = lazy(() => import("./pages/Reviewer/Thankyou"));
const InviteReviewers           = lazy(() => import("./pages/Organizer/InviteReviewers"));
const OrganizerConferences      = lazy(() => import("./pages/Organizer/OrganizerConferences"));
const AuthorConferences         = lazy(() => import("./pages/Author/AuthorConferences"));
const ReviewerConferences       = lazy(() => import("./pages/Reviewer/ReviewerConferences"));
const AcceptedInvitations       = lazy(() => import("./pages/Organizer/AcceptedInvitations"));
const AssignPapersPage          = lazy(() => import("./pages/Organizer/AssignPapers"));
const AssignmentsPage           = lazy(() => import("./pages/Organizer/AssignmentsPage"));
const AllPapersToReview         = lazy(() => import("./pages/Reviewer/AllPapersToReview"));
const ReviewForm                = lazy(() => import("./pages/Reviewer/ReviewForm"));
const ReviewManagement          = lazy(() => import("./pages/Organizer/ReviewManagement"));
const ReviewDetails             = lazy(() => import("./pages/Organizer/CheckReviews"));
const AllPapersOfAuthor         = lazy(() => import("./pages/Author/ShowAllPapersOfUser"));
const UpdatePaper               = lazy(() => import("./pages/Author/UpdatePaper"));
const ConferencePapersDecisions = lazy(() => import("./pages/Organizer/PapersDecision"));
const EditConference            = lazy(() => import("./pages/Organizer/EditConference"));
const LearnMore                 = lazy(() => import("./pages/learnmore"));
const ConferenceLayout          = lazy(() => import("./components/conferenceLayout"));
const AuthorForm                = lazy(() => import("./pages/Author/AuthorForm"));
const RolePrivateRoute          = lazy(() => import("./routes/roleAuth"));

axios.defaults.baseURL = process.env.REACT_APP_API;

// Inner component so useLocation works inside the Router context
const AppContent = () => {
  const { pathname } = useLocation();

  // Hide the footer on all dashboard routes — the fixed sidebar would
  // overlap it and a footer makes no sense inside a dashboard layout.
  const isDashboard = pathname.startsWith("/userdashboard");

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/"                element={<Home />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/login"           element={<Login />} />
            <Route path="/forgot-password" element={<Forgotpassword />} />
            <Route path="/learn-more"      element={<LearnMore />} />
            <Route path="/all-conferences" element={<AllConferences />} />
            <Route path="*"               element={<Pagenotfound />} />

            <Route path="/userdashboard/*" element={<UserPrivateRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="user-dashboard"    element={<UserDashboard />} />
                <Route path="create-conference" element={<ConferenceCreationForm />} />

                <Route element={<RolePrivateRoute role="organizer" />}>
                  <Route path="organizer-dashboard"   element={<OrganizerDashboard />} />
                  <Route path="invite-reviewers"      element={<InviteReviewers />} />
                  <Route path="conferences-organizer" element={<OrganizerConferences />} />
                  <Route path="accepted-invitations"  element={<AcceptedInvitations />} />
                  <Route path="assign-papers"         element={<AssignPapersPage />} />
                  <Route path="assignments"           element={<AssignmentsPage />} />
                  <Route path="review-management"     element={<ReviewManagement />} />
                  <Route path="reviews"               element={<ReviewDetails />} />
                  <Route path="papers/decisions"      element={<ConferencePapersDecisions />} />
                  <Route path="edit-conference"       element={<EditConference />} />
                </Route>

                <Route element={<RolePrivateRoute role="reviewer" />}>
                  <Route path="reviewer-dashboard"   element={<ReviewerDashboard />} />
                  <Route path="conferences-reviewer" element={<ReviewerConferences />} />
                  <Route path="all-assigned-papers"  element={<AllPapersToReview />} />
                  <Route path="review-form"          element={<ReviewForm />} />
                </Route>

                <Route element={<RolePrivateRoute role="author" />}>
                  <Route path="author-dashboard"   element={<AuthorDashboard />} />
                  <Route path="conferences-author" element={<AuthorConferences />} />
                  <Route path="papers"             element={<AllPapersOfAuthor />} />
                  <Route path="update-paper"       element={<UpdatePaper />} />
                </Route>

                <Route path="roles"        element={<RolesPage />} />
                <Route path="user-profile" element={<UserProfile />} />
              </Route>
            </Route>

            <Route path="conference/:acronym/submit-paper/:id" element={<AuthorForm />} />

            <Route path="/conference/:id" element={<ConferenceLayout />}>
              <Route index element={<ConferenceDetailsPage />} />
              <Route path="invite-reviewers"     element={<InviteReviewers />} />
              <Route path="accepted-invitations" element={<AcceptedInvitations />} />
              <Route path="assign-papers"        element={<AssignPapersPage />} />
              <Route path="assignments"          element={<AssignmentsPage />} />
              <Route path="review-management"    element={<ReviewManagement />} />
              <Route path="papers/decisions"     element={<ConferencePapersDecisions />} />
              <Route path="papers"               element={<AllPapersOfAuthor />} />
            </Route>

            <Route path="/paper/:id"                  element={<PaperSubmissionDetails />} />
            <Route path="/conference/submissions/:id" element={<ConferencePapers />} />
            <Route path="/thankyou"                   element={<ThankYouPage />} />
          </Routes>
        </Suspense>
      </main>
      {!isDashboard && <Footer />}
    </div>
  );
};

function App() {
  return (
    <OrganizerConferenceProvider>
      <Toaster
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "0.75rem",
            fontFamily: "Outfit, sans-serif",
            fontWeight: 600,
            fontSize: "0.875rem",
          },
        }}
        position="bottom-right"
      />
      <AppContent />
    </OrganizerConferenceProvider>
  );
}

export default App;