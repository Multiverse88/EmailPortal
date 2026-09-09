import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { ElCompanion } from '@/components/companion/el-companion';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'MailPortal - EasyLegal',
  description: 'Custom email client for EasyLegal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${manrope.variable} bg-background text-on-background antialiased font-sans`}>
        {children}
        <ElCompanion />
      </body>
    </html>
  );
}
