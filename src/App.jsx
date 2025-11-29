import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import DevErrorBoundary from "@/components/DevErrorBoundary"

function App() {
  return (
    <DevErrorBoundary>
      <Pages />
      <Toaster />
    </DevErrorBoundary>
  )
}

export default App 