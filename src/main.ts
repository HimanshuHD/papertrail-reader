import { startupScreen } from './services/startup-screen'

startupScreen.stage('library', 'Loading your reading space')
void import('./bootstrap').then(({ bootstrap }) => bootstrap()).catch(() => startupScreen.fail())
