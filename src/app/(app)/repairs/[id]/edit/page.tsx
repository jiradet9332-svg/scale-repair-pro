import { getRepairById } from '@/lib/store'
import { notFound } from 'next/navigation'
import RepairForm from '../../RepairForm'

export default function EditRepairPage({ params }: { params: { id: string } }) {
  const repair = getRepairById(params.id)
  if (!repair) notFound()
  return <RepairForm defaultValues={repair} isEdit />
}
