import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { ElCompanion } from '@/components/companion/el-companion';
import { GlobalDropHandler } from '@/components/global-drop-handler';

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
      <body className={`${manrope.variable} ${manrope.className} bg-background text-on-background antialiased font-sans`}>
        <GlobalDropHandler />
        {children}
        <ElCompanion />
      </body>
    </html>
  );
}
