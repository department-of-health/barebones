// Use this file to change prototype configuration.
// Note: prototype config can be overridden using environment variables (eg on heroku)
module.exports = {
  serviceName: 'Medical Examiner Service',
  caseRef: 'ME000001',
  // Default port that prototype runs on
  port: '3000',
  // Enable or disable password protection on production
  useAuth: 'true',
  // Force HTTP to redirect to HTTPs on production
  useHttps: 'true',
}
