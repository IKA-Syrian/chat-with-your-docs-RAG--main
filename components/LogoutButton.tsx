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
      className="py-2 px-4 rounded-md no-underline bg-btn-background hover:bg-btn-background-hover"
    >
      Logout
    </button>
  );
}
