import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    // 1. เข้ารหัสรหัสผ่าน "0384"
    const hashedPassword = await bcrypt.hash('0384', 10)

    // 2. ปรับมาใช้ username: 'admin' ในการดักควานหาข้อมูลเพื่อทำ upsert
    const admin = await prisma.user.upsert({
        where: {
            username: 'admin' // แก้ตรงนี้ตามที่กฎของ Schema คุณต้องการ
        },
        update: {},
        create: {
            username: 'admin',
            email: 'admin@example.com',
            name: 'Admin',
            password: hashedPassword,
            role: 'ADMIN',
        },
    })

    console.log('✅ Seed default admin successfully:', admin.username)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })