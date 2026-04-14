import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Center,
  Checkbox,
  CloseButton,
  Container,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import {
  api,
  type AvailabilityRule,
  type AvailabilityRuleInput,
  type BookingStatus,
  type SlotDuration,
  ApiError,
} from '../api/client';

const WEEKDAYS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '7', label: 'Sun' },
];

function weekdayLabel(n: number) {
  return WEEKDAYS.find((w) => w.value === String(n))?.label ?? String(n);
}

// ─── Availability Panel ───────────────────────────────────────────────────────

function AvailabilityPanel({
  slug,
  initialRules,
}: {
  slug: string;
  initialRules: AvailabilityRule[];
}) {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<AvailabilityRuleInput[]>(
    initialRules.map(({ weekdays, startTime, endTime }) => ({
      weekdays,
      startTime,
      endTime,
    })),
  );
  const [addOpen, setAddOpen] = useState(false);

  const addForm = useForm({
    initialValues: {
      weekdays: ['1', '2', '3', '4', '5'] as string[],
      startTime: '09:00',
      endTime: '17:00',
    },
    validate: {
      weekdays: (v: string[]) => (v.length > 0 ? null : 'Select at least one day'),
      startTime: (v: string, values: { weekdays: string[]; startTime: string; endTime: string }) =>
        v < values.endTime ? null : 'Must be before end time',
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.updateAvailability(slug, { rules }),
    onSuccess: () => {
      notifications.show({ message: 'Availability updated', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['manage', slug] });
    },
    onError: () => {
      notifications.show({ message: 'Failed to save availability', color: 'red' });
    },
  });

  const handleAdd = addForm.onSubmit((values) => {
    setRules((prev) => [
      ...prev,
      {
        weekdays: values.weekdays.map(Number).sort((a, b) => a - b),
        startTime: values.startTime,
        endTime: values.endTime,
      },
    ]);
    setAddOpen(false);
    addForm.reset();
  });

  return (
    <Stack maw={560}>
      {rules.length === 0 && (
        <Text c="dimmed">No rules defined. Add one to start accepting bookings.</Text>
      )}

      {rules.map((rule, i) => (
        <Paper key={i} withBorder p="sm" radius="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Group gap={4}>
                {rule.weekdays.map((d) => (
                  <Badge key={d} variant="light" size="sm">
                    {weekdayLabel(d)}
                  </Badge>
                ))}
              </Group>
              <Text size="sm" c="dimmed">
                {rule.startTime} – {rule.endTime}
              </Text>
            </Stack>
            <CloseButton aria-label="Remove rule" onClick={() => setRules((prev) => prev.filter((_, idx) => idx !== i))} />
          </Group>
        </Paper>
      ))}

      <Group>
        <Button variant="light" onClick={() => setAddOpen(true)}>
          Add Rule
        </Button>
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Save Changes
        </Button>
      </Group>

      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="New availability rule">
        <form onSubmit={handleAdd}>
          <Stack>
            <Checkbox.Group label="Days of the week" {...addForm.getInputProps('weekdays')}>
              <Group mt="xs" gap="xs">
                {WEEKDAYS.map((day) => (
                  <Checkbox key={day.value} value={day.value} label={day.label} />
                ))}
              </Group>
            </Checkbox.Group>
            {addForm.errors.weekdays && (
              <Text size="xs" c="red">
                {addForm.errors.weekdays}
              </Text>
            )}

            <Group grow>
              <TimeInput label="Start time" {...addForm.getInputProps('startTime')} />
              <TimeInput label="End time" {...addForm.getInputProps('endTime')} />
            </Group>

            <Button type="submit">Add</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ─── Slot Durations Panel ─────────────────────────────────────────────────────

function SlotDurationsPanel({
  slug,
  initialDurations,
}: {
  slug: string;
  initialDurations: SlotDuration[];
}) {
  const queryClient = useQueryClient();
  const [newMinutes, setNewMinutes] = useState<number | string>(30);

  const { data: durations } = useQuery({
    queryKey: ['slot-durations', slug],
    queryFn: () => api.listSlotDurations(slug),
    initialData: initialDurations,
  });

  const addMutation = useMutation({
    mutationFn: () => api.addSlotDuration(slug, { minutes: newMinutes as number }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slot-durations', slug] });
      queryClient.invalidateQueries({ queryKey: ['manage', slug] });
      setNewMinutes(30);
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.status === 409
          ? 'This duration already exists'
          : 'Failed to add duration';
      notifications.show({ message: msg, color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSlotDuration(slug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slot-durations', slug] });
      queryClient.invalidateQueries({ queryKey: ['manage', slug] });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.status === 409
          ? 'Cannot remove the last slot duration'
          : 'Failed to delete duration';
      notifications.show({ message: msg, color: 'red' });
    },
  });

  const isValidMinutes =
    typeof newMinutes === 'number' && newMinutes > 0 && newMinutes % 15 === 0;

  return (
    <Stack maw={360}>
      {(durations ?? []).map((d) => (
        <Paper key={d.id} withBorder p="sm" radius="sm">
          <Group justify="space-between">
            <Text>{d.minutes} minutes</Text>
            <CloseButton
              aria-label="Remove duration"
              onClick={() => deleteMutation.mutate(d.id)}
              disabled={deleteMutation.isPending}
            />
          </Group>
        </Paper>
      ))}

      <Group align="flex-end">
        <NumberInput
          label="New duration (minutes)"
          value={newMinutes}
          onChange={setNewMinutes}
          min={15}
          step={15}
          placeholder="e.g. 45"
          style={{ width: 180 }}
        />
        <Button
          onClick={() => addMutation.mutate()}
          loading={addMutation.isPending}
          disabled={!isValidMinutes}
        >
          Add
        </Button>
      </Group>
    </Stack>
  );
}

// ─── Bookings Panel ───────────────────────────────────────────────────────────

function BookingsPanel({ slug, timezone }: { slug: string; timezone: string }) {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', slug, statusFilter],
    queryFn: () =>
      api.listBookings(slug, statusFilter === 'all' ? undefined : statusFilter),
    enabled: !!slug,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.cancelBooking(slug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', slug] });
      notifications.show({ message: 'Booking cancelled', color: 'green' });
    },
  });

  const formatDt = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  return (
    <Stack>
      <Select
        value={statusFilter}
        onChange={(v) => setStatusFilter((v as BookingStatus | 'all') ?? 'all')}
        data={[
          { value: 'all', label: 'All' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
        style={{ width: 180 }}
      />

      {isLoading && <Loader size="sm" />}

      {!isLoading && bookings?.length === 0 && (
        <Text c="dimmed">No bookings found.</Text>
      )}

      {bookings && bookings.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Guest</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Time</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {bookings.map((booking) => (
              <Table.Tr key={booking.id}>
                <Table.Td>{booking.guestName}</Table.Td>
                <Table.Td>{booking.guestEmail}</Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDt(booking.startsAt)}</Text>
                  {booking.note && (
                    <Text size="xs" c="dimmed" maw={240} truncate>
                      {booking.note}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge color={booking.status === 'confirmed' ? 'green' : 'gray'}>
                    {booking.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {booking.status === 'confirmed' && (
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      loading={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(booking.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ─── ManagePage ───────────────────────────────────────────────────────────────

export default function ManagePage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['manage', slug],
    queryFn: () => api.getCalendarSettings(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (error || !settings) {
    return (
      <Center h="100vh">
        <Alert color="red" title="Not found" maw={400}>
          Calendar &ldquo;{slug}&rdquo; not found.
        </Alert>
      </Center>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1}>{settings.calendar.name}</Title>
          <Text size="sm" c="dimmed">
            Timezone: {settings.calendar.timezone}
          </Text>
        </div>

        <Tabs defaultValue="availability">
          <Tabs.List>
            <Tabs.Tab value="availability">Availability</Tabs.Tab>
            <Tabs.Tab value="durations">Slot Durations</Tabs.Tab>
            <Tabs.Tab value="bookings">Bookings</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="availability" pt="md">
            <AvailabilityPanel slug={slug!} initialRules={settings.availabilityRules} />
          </Tabs.Panel>

          <Tabs.Panel value="durations" pt="md">
            <SlotDurationsPanel slug={slug!} initialDurations={settings.slotDurations} />
          </Tabs.Panel>

          <Tabs.Panel value="bookings" pt="md">
            <BookingsPanel slug={slug!} timezone={settings.calendar.timezone} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
