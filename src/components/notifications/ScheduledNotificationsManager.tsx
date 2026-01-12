import { useState, useEffect } from 'react';
import { useScheduledNotifications } from '@/hooks/use-scheduled-notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, Trash2, Plus } from 'lucide-react';
import { ScheduledNotification } from '@/lib/scheduled-notifications';
import { useToast } from '@/components/ui/use-toast';

export function ScheduledNotificationsManager() {
  const { scheduleDaily, remove, getAll } = useScheduledNotifications();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [hour, setHour] = useState<number>(9);
  const [minute, setMinute] = useState<number>(0);
  const [title, setTitle] = useState<string>('Daily Reminder');
  const [body, setBody] = useState<string>('This is your daily reminder!');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const all = await getAll();
    setNotifications(all);
  };

  const handleSchedule = async () => {
    if (!title.trim() || !body.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in title and body',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await scheduleDaily(title, body, hour, minute, {
        tag: 'daily-reminder',
      });
      toast({
        title: 'Success',
        description: `Scheduled daily notification at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      });
      setTitle('Daily Reminder');
      setBody('This is your daily reminder!');
      await loadNotifications();
    } catch (error) {
      console.error('Error scheduling notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule notification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
      toast({
        title: 'Success',
        description: 'Notification removed',
      });
      await loadNotifications();
    } catch (error) {
      console.error('Error removing notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove notification',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Notifications</CardTitle>
        <CardDescription>
          Schedule notifications to appear at specific times. These work without Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Daily Reminder"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Input
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="This is your daily reminder!"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="hour">Hour (0-23)</Label>
            <Input
              id="hour"
              type="number"
              min="0"
              max="23"
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minute">Minute (0-59)</Label>
            <Input
              id="minute"
              type="number"
              min="0"
              max="59"
              value={minute}
              onChange={(e) => setMinute(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <Button onClick={handleSchedule} disabled={isLoading} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Schedule Daily Notification
        </Button>

        {notifications.length > 0 && (
          <div className="space-y-2">
            <Label>Scheduled Notifications</Label>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="font-medium">{notification.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {notification.body}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Daily at {formatTime(notification.scheduledTime)}
                    {notification.repeat && ` (${notification.repeat})`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(notification.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
