import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Anchor,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { api, ApiError, type CreateCalendarRequest } from '../api/client';

const TIMEZONES: string[] = Intl.supportedValuesOf('timeZone');

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/-+/g, '-')
    .slice(0, 50);
}

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data: calendars, isLoading } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => api.listCalendars(),
  });

  const form = useForm<CreateCalendarRequest>({
    initialValues: {
      name: '',
      slug: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      slug: (v) =>
        /^[a-z0-9-]{3,50}$/.test(v)
          ? null
          : 'Only lowercase letters, digits and hyphens, 3–50 chars',
      timezone: (v) => (v ? null : 'Timezone is required'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateCalendarRequest) => api.createCalendar(values),
    onSuccess: (calendar) => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      handleClose();
      navigate(`/${calendar.slug}/manage`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        form.setFieldError('slug', 'Slug already taken');
      } else {
        notifications.show({ message: 'Failed to create calendar', color: 'red' });
      }
    },
  });

  const handleClose = () => {
    setModalOpen(false);
    form.reset();
    setSlugTouched(false);
  };

  let calendarList: ReactNode;
  if (isLoading) {
    calendarList = <Center><Loader /></Center>;
  } else if (calendars?.length) {
    calendarList = (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Slug</Table.Th>
            <Table.Th>Timezone</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {calendars.map((cal) => (
            <Table.Tr key={cal.id}>
              <Table.Td>{cal.name}</Table.Td>
              <Table.Td>
                <Text ff="monospace" size="sm">
                  {cal.slug}
                </Text>
              </Table.Td>
              <Table.Td>{cal.timezone}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Anchor component={Link} to={`/${cal.slug}/manage`} size="sm">
                    Manage
                  </Anchor>
                  <Anchor component={Link} to={`/${cal.slug}`} size="sm">
                    Book
                  </Anchor>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  } else {
    calendarList = <Text c="dimmed">No calendars yet. Create one to get started.</Text>;
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Title order={1}>Calendars</Title>
          <Button onClick={() => setModalOpen(true)}>New calendar</Button>
        </Group>

        {calendarList}
      </Stack>

      <Modal opened={modalOpen} onClose={handleClose} title="New calendar" centered>
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <Stack gap="md">
            <TextInput
              label="Name"
              placeholder="Andrey Novosad"
              required
              value={form.values.name}
              error={form.errors.name}
              onChange={(e) => {
                form.setFieldValue('name', e.currentTarget.value);
                if (!slugTouched) {
                  form.setFieldValue('slug', slugify(e.currentTarget.value));
                }
              }}
            />
            <TextInput
              label="Slug"
              description="Used in the booking URL: /:slug"
              placeholder="andrey-novosad"
              required
              value={form.values.slug}
              error={form.errors.slug}
              onChange={(e) => {
                setSlugTouched(true);
                form.setFieldValue('slug', e.currentTarget.value);
              }}
            />
            <Select
              label="Timezone"
              placeholder="Pick a timezone"
              required
              searchable
              data={TIMEZONES}
              {...form.getInputProps('timezone')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
