import { useUsers } from '../api/getUsers';
import { Button } from '../../../components/Button';
import { useAppStore } from '../../../store/store';

export const UserList = () => {
  const { data: users, isLoading, error, refetch } = useUsers();
  const { theme, toggleTheme } = useAppStore();

  if (isLoading) return <div className="p-4 text-center">Loading users...</div>;
  if (error) return <div className="p-4 text-red-500 text-center">Error loading users</div>;

  return (
    <div className={`p-6 max-w-4xl mx-auto rounded-xl shadow-md ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Users Directory</h2>
        <div className="space-x-2">
          <Button onClick={toggleTheme} variant="outline">
            Toggle Theme ({theme})
          </Button>
          <Button onClick={() => refetch()} variant="default">
            Refresh
          </Button>
        </div>
      </div>
      
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users?.slice(0, 6).map((user) => (
          <li key={user.id} className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
            <h3 className="font-semibold text-lg">{user.name}</h3>
            <p className="text-sm opacity-75">{user.email}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
