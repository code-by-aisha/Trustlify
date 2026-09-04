import { createRoot } from 'react-dom/client'
import StartupError from '@/components/StartupError'
import { checkStartupEnv } from '@/lib/env'
import './index.css'

const rootElement = document.getElementById('root')!
const missing = checkStartupEnv()

if (missing.length > 0) {
  // Without this gate the Supabase client throws while its module is still
  // being imported, and the visitor gets an unexplained blank page.
  createRoot(rootElement).render(<StartupError missing={missing} />)
} else {
  // Dynamic so nothing that needs Supabase is evaluated before the check above.
  void import('@/renderApp')
    .then(({ renderApp }) => renderApp(rootElement))
    .catch((error: unknown) => {
      createRoot(rootElement).render(
        <StartupError
          missing={[]}
          detail={error instanceof Error ? error.message : String(error)}
        />
      )
    })
}
