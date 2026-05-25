import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/dashboard?openSettings=1');
}
