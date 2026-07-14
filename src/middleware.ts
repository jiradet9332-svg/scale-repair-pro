// Auth middleware disabled — uncomment and configure NextAuth when DB is ready
// export { default } from 'next-auth/middleware'
// export const config = { matcher: ['/dashboard/:path*', '/repairs/:path*', '/parts/:path*', '/scales/:path*'] }

export function middleware() {}
export const config = { matcher: [] }
