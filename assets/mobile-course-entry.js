// Open the authenticated student card when entering the course home.
// Explicit material anchors remain directly accessible to everyone.
if (!window.location.hash) {
  window.location.replace("https://aab-mobile-attendance.vercel.app/progress");
}
