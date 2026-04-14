import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
  SimpleGrid,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { api, type Slot, ApiError } from '../api/client';

export default function BookingPage() {
  const queryClient = useQueryClient();
  const { slug } = useParams() as { slug: string };
  const [duration, setDuration] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { data: calendar, isLoading, error } = useQuery({
    queryKey: ['calendar', slug],
    queryFn: () => api.getCalendar(slug),
    enabled: !!slug,
  });

  useEffect(() => {
    if (calendar && duration === null && calendar.slotDurations.length > 0) {
      setDuration(calendar.slotDurations[0]);
    }
  }, [calendar, duration]);

  const dateStr = selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : undefined;

  const { data: slots, isFetching: slotsLoading } = useQuery({
    queryKey: ['slots', slug, duration, dateStr],
    queryFn: () => api.getSlots(slug, duration!, dateStr, dateStr),
    enabled: !!slug && !!duration && !!dateStr,
  });

  const form = useForm({
    initialValues: { guestName: '', guestEmail: '', note: '' },
    validate: {
      guestName: (v: string) => (v.trim() ? null : 'Name is required'),
      guestEmail: (v: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Valid email is required',
    },
  });

  const bookMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      api.createBooking(slug, {
        startsAt: selectedSlot!.startsAt,
        endsAt: selectedSlot!.endsAt,
        guestName: values.guestName,
        guestEmail: values.guestEmail,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      setSelectedSlot(null);
      setConfirmed(true);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['slots', slug, duration, dateStr] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        notifications.show({
          title: 'Slot no longer available',
          message: 'Someone just booked this slot. Please pick another time.',
          color: 'red',
        });
        setSelectedSlot(null);
      }
    },
  });

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: calendar?.timezone ?? 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (error || !calendar) {
    return (
      <Center h="100vh">
        <Alert color="red" title="Calendar not found" maw={400}>
          No calendar found for &ldquo;{slug}&rdquo;.
        </Alert>
      </Center>
    );
  }

  if (confirmed) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md" maw={400}>
          <Title order={2}>Booking Confirmed</Title>
          <Text ta="center" c="dimmed">
            Your appointment has been booked successfully.
          </Text>
          <Button onClick={() => setConfirmed(false)}>Book another slot</Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1}>{calendar.name}</Title>
          <Text size="sm" c="dimmed">
            Timezone: {calendar.timezone}
          </Text>
        </div>

        <Stack gap="sm">
          <Text fw={600}>Meeting duration</Text>
          <Group>
            {calendar.slotDurations.map((d) => (
              <Button
                key={d}
                variant={duration === d ? 'filled' : 'outline'}
                onClick={() => setDuration(d)}
              >
                {d} min
              </Button>
            ))}
          </Group>
        </Stack>

        <Divider />

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <Stack gap="sm">
              <Text fw={600}>Select a date</Text>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                minDate={new Date()}
              />
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 7 }}>
            <Stack gap="sm">
              <Text fw={600}>
                Available times
                {selectedDate && (
                  <Text span size="sm" c="dimmed" ml="xs" fw={400}>
                    {dayjs(selectedDate).format('MMM D, YYYY')}
                  </Text>
                )}
              </Text>

              {slotsLoading && <Loader size="sm" />}

              {!slotsLoading && slots !== undefined && slots.length === 0 && (
                <Text c="dimmed">No available slots for this date.</Text>
              )}

              {!slotsLoading && slots && slots.length > 0 && (
                <SimpleGrid cols={{ base: 4, sm: 6 }} spacing="xs">
                  {slots.map((slot) => (
                    <Button
                      key={slot.startsAt}
                      variant="outline"
                      size="sm"
                      color={slot.available ? undefined : 'gray'}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatTime(slot.startsAt)}
                    </Button>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>

      <Modal
        opened={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
        title="Book your appointment"
      >
        {selectedSlot && (
          <Stack>
            <Paper withBorder p="sm" radius="sm" bg="gray.0">
              <Text size="sm" fw={600}>
                {formatTime(selectedSlot.startsAt)} – {formatTime(selectedSlot.endsAt)}
              </Text>
              <Text size="sm" c="dimmed">
                {dayjs(selectedDate).format('MMM D, YYYY')} &middot;{' '}
                {selectedSlot.durationMinutes} min
              </Text>
            </Paper>

            <form
              noValidate
              onSubmit={form.onSubmit((values) => bookMutation.mutate(values))}
            >
              <Stack>
                <TextInput
                  label="Your name"
                  placeholder="Jane Smith"
                  required
                  {...form.getInputProps('guestName')}
                />
                <TextInput
                  label="Email"
                  placeholder="jane@example.com"
                  type="email"
                  required
                  {...form.getInputProps('guestEmail')}
                />
                <Textarea
                  label="Note (optional)"
                  placeholder="What would you like to discuss?"
                  {...form.getInputProps('note')}
                />
                <Button type="submit" loading={bookMutation.isPending}>
                  Confirm booking
                </Button>
              </Stack>
            </form>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
