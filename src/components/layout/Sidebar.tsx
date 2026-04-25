import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_GROUPS } from './nav-config';
import { useAuth } from '@/contexts/AuthContext';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close on route change (mobile)
  useEffect(() => {
    if (isMobile && onClose) {
      onClose();
    }
  }, [location.pathname, isMobile, onClose]);

  // Filter nav groups and items based on permissions and role
  const isAdmin = user?.role === 'admin';

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // Admin items only visible to admins
      if (item.requiredPermission && !isAdmin) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  const sidebarContent = (
    <nav className="flex flex-col h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700">
      {/* Close button for mobile */}
      {isMobile && (
        <div className="flex justify-end p-4 border-b border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="إغلاق القائمة الجانبية"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Nav Groups */}
      <div className="flex-1 overflow-y-auto">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.id}>
            {/* Group Label (show if multiple groups) */}
            {visibleGroups.length > 1 && (
              <div className="px-4 py-3 mt-6 first:mt-0">
                <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {group.labelAr}
                </h3>
              </div>
            )}

            {/* Group Items */}
            <div className="space-y-1 px-2">
              {group.items.map((item) => {
                const isActive = location.pathname === item.to;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1">{item.labelAr}</span>
                    {isActive && (
                      <div className="h-1 w-1 rounded-full bg-primary-600 dark:bg-primary-400" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Divider between groups */}
            {groupIndex < visibleGroups.length - 1 && (
              <div className="my-4 mx-2 h-px bg-neutral-200 dark:bg-neutral-700" />
            )}
          </div>
        ))}
      </div>

      {/* Footer (optional: user info) */}
      {user && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 p-4">
          <div className="text-xs text-neutral-600 dark:text-neutral-400">
            <p className="font-medium text-neutral-900 dark:text-neutral-50">{user.full_name || user.username}</p>
            <p className="text-neutral-500 dark:text-neutral-400 capitalize">
              {user.role === 'admin' ? 'مدير' : user.role === 'manager' ? 'مسؤول' : 'مستخدم'}
            </p>
          </div>
        </div>
      )}
    </nav>
  );

  // Mobile: render as off-canvas drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
        )}

        {/* Drawer */}
        <div
          className={cn(
            'fixed inset-y-0 right-0 z-50 w-64 transform transition-transform duration-200 ease-in-out',
            isOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  // Desktop: render as fixed sidebar
  return (
    <div className="hidden md:block w-64 h-screen border-r border-neutral-200 dark:border-neutral-700">
      {sidebarContent}
    </div>
  );
}
