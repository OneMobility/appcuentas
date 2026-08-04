"use client";

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const NotificationsPopover = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, isLoading } = useNotifications();

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-rose-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full bg-white/50 backdrop-blur-sm border border-slate-100">
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 rounded-3xl overflow-hidden shadow-2xl border-slate-100" align="end">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <h3 className="text-sm font-black uppercase tracking-widest">Notificaciones</h3>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 text-[10px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/10 gap-1">
              <CheckCheck className="h-3 w-3" /> Todo leído
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <BellOff className="h-10 w-10 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">Bandeja vacía</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-4 transition-colors group relative",
                    !n.is_read ? "bg-indigo-50/40" : "bg-white hover:bg-slate-50"
                  )}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 shrink-0">{getIcon(n.type)}</div>
                    <div className="flex-1 space-y-1">
                      <p className={cn("text-xs font-bold text-slate-900 leading-tight", !n.is_read && "pr-4")}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-snug">{n.body}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter pt-1">
                        {format(parseISO(n.created_at), "d 'de' MMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  {!n.is_read && (
                    <div className="absolute top-4 right-4 h-1.5 w-1.5 bg-indigo-600 rounded-full group-hover:opacity-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPopover;