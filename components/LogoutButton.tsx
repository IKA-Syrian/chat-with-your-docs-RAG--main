'use client';

import { useAuth } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';

export default function LogoutButton() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: 'Success',
        description: 'Signed out successfully!',
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to sign out',
      });
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="text-xs font-medium text-ink-soft hover:text-ink transition-colors duration-200 ease-out-expo"
    >
      Sign out
    </button>
  );
}
