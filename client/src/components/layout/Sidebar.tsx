import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Home,
    Gamepad2,
    Trophy,
    User,
    X,
    Crown,
    ShieldCheck
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { user, logout } = useAuth();

    // Наша навигация теперь основана на реальных роутах приложения
    const menuItems = [
        { path: '/', icon: Home, label: 'Панель управления' },
        { path: '/games', icon: Gamepad2, label: 'Игры' },
        { path: '/tournaments', icon: Trophy, label: 'Турниры' },
        { path: '/profile', icon: User, label: 'Настройки профиля' },
    ];
    
    // Стили для активной/неактивной ссылки
    const linkClasses = "w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors text-slate-300 hover:bg-slate-700 hover:text-white";
    const activeLinkClasses = "bg-slate-950 text-white border-r-2 border-blue-400";
    
    const getNavLinkClass = ({ isActive }: { isActive: boolean }) => 
        isActive ? `${linkClasses} ${activeLinkClasses}` : linkClasses;
    
    const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : '??';

    return (
        <>
            {/* Мобильная версия с затемнением */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Сайдбар */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700">
                    <Link to="/" className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                            <Crown className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">GameHub</h1>
                            <p className="text-sm text-slate-400">Игровая платформа</p>
                        </div>
                    </Link>
                    
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="mt-8 px-4 space-y-2">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'} // `end` для главной, чтобы не подсвечивалась на других страницах
                            className={getNavLinkClass}
                            onClick={() => setIsOpen(false)}
                        >
                            <item.icon className="w-5 h-5 mr-3" />
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                    {/* Ссылка на админку, видимая только админам */}
                    {user?.role === 'ADMIN' && (
                         <NavLink
                            to="/admin"
                            className={getNavLinkClass}
                            onClick={() => setIsOpen(false)}
                        >
                            <ShieldCheck className="w-5 h-5 mr-3" />
                            <span className="font-medium">Админка</span>
                        </NavLink>
                    )}
                </nav>

                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
                     <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">{initials}</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{user?.username || 'Игрок'}</p>
                            <p className="text-xs text-slate-400">{user?.email || '...'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;