import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ElCompanion } from '@/components/companion/el-companion';
import { GlobalDropHandler } from '@/components/global-drop-handler';

const sfPro = localFont({
  src: [
    {
      path: '../fonts/SFProDisplay-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/SFProDisplay-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/SFProDisplay-Semibold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/SFProDisplay-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-sf-pro',
  display: 'swap',
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
      <body className={`${sfPro.variable} ${sfPro.className} bg-background text-on-background subpixel-antialiased font-sans`}>
        <GlobalDropHandler />
        {children}
        <ElCompanion />
      </body>
    </html>
  );
}
