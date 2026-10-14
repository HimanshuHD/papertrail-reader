import { startupScreen } from './services/startup-screen'

startupScreen.stage('library', 'Loading your reading space')
void import('./bootstrap')
  .then(({ bootstrap }) => {
    startupScreen.complete('resources')
    return bootstrap()
  })
  .catch(() => startupScreen.fail())
