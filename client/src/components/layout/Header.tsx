import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Link } from 'react-router-dom';

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const { user } = useAuth();
    const { unreadCount } = useNotifications();

    return (
        <header className="bg-slate-800 shadow-sm border-b border-slate-700">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Кнопка для мобильного меню */}
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 rounded-md text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    
                    {/* Пустой div для выравнивания на десктопе */}
                    <div className="hidden lg:block"></div>

                    <div className="flex items-center space-x-4">
                        <Link to="/notifications" className="relative text-slate-400 hover:text-white">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>

                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-slate-300">Онлайн</span>
                        </div>
                        <div className="bg-green-900 text-green-100 px-3 py-1 rounded-full text-sm font-medium">
                            Баланс: ${user?.balance.toFixed(2) || '0.00'}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;