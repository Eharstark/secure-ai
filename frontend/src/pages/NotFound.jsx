import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, EmptyState } from '../components/ui'

export default function NotFound() {
  return <EmptyState icon={Compass} title="Page not found" action={<Link to="/"><Button variant="primary">Back to overview</Button></Link>}>That address doesn't exist in the console.</EmptyState>
}
