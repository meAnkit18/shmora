import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { SessionPage } from './pages/SessionPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetailsPage } from './pages/CourseDetailsPage';
import { StudioLayout } from './studio/StudioLayout';
import { StudioDashboardPage } from './studio/StudioDashboardPage';
import { StudioCoursesPage } from './studio/StudioCoursesPage';
import { StudioPlaceholderPage } from './studio/StudioPlaceholderPage';
import { CourseBuilderPage } from './studio/builder/CourseBuilderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/session" element={<SessionPage />} />

        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:slug" element={<CourseDetailsPage />} />

        <Route path="/studio" element={<StudioLayout />}>
          <Route index element={<StudioDashboardPage />} />
          <Route path="courses" element={<StudioCoursesPage />} />
          <Route
            path="analytics"
            element={
              <StudioPlaceholderPage
                title="Analytics"
                description="Once learners take your courses, watch enrollments, completion, questions asked mid-lesson, and where students interrupt most — the moments your teaching can improve."
              />
            }
          />
          <Route
            path="settings"
            element={
              <StudioPlaceholderPage
                title="Settings"
                description="Creator profile, payout details, and AI teacher defaults will live here."
              />
            }
          />
        </Route>

        <Route path="/studio/courses/:id/edit" element={<CourseBuilderPage />} />
      </Routes>
    </BrowserRouter>
  );
}
