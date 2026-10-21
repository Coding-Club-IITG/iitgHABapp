import { useEffect } from "react";
import { Form, Input, DatePicker, InputNumber, Switch, Modal } from "antd";
import dayjs from "dayjs";

const toDayjs = (value) => (value ? dayjs(value) : null);
const toIso = (value) => (value ? value.toISOString() : null);

/** Create / edit modal for an event. `initial` is the event when editing. */
export default function EventForm({ open, initial, saving, onCancel, onSubmit }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      title: initial?.title || "",
      description: initial?.description || "",
      venue: initial?.venue || "",
      startsAt: toDayjs(initial?.startsAt),
      endsAt: toDayjs(initial?.endsAt),
      registrationClosesAt: toDayjs(initial?.registrationClosesAt),
      capacity: initial?.capacity ?? 0,
      requiresApproval: initial?.requiresApproval ?? false,
      isPublished: initial?.isPublished ?? true,
    });
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit({
      ...values,
      startsAt: toIso(values.startsAt),
      endsAt: toIso(values.endsAt),
      registrationClosesAt: toIso(values.registrationClosesAt),
    });
  };

  return (
    <Modal
      title={initial ? "Edit event" : "Create event"}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={initial ? "Save" : "Create"}
      confirmLoading={saving}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input placeholder="e.g. Alcheringa Pronite" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="venue" label="Venue">
          <Input placeholder="e.g. Auditorium" />
        </Form.Item>
        <Form.Item name="startsAt" label="Starts" rules={[{ required: true }]}>
          <DatePicker showTime format="DD MMM YYYY, h:mm A" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="endsAt" label="Ends (optional)">
          <DatePicker showTime format="DD MMM YYYY, h:mm A" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          name="registrationClosesAt"
          label="Registrations close (optional)"
          extra="Defaults to the end time, or the start time if there is no end."
        >
          <DatePicker showTime format="DD MMM YYYY, h:mm A" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="capacity" label="Capacity" extra="0 means unlimited.">
          <InputNumber min={0} precision={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          name="requiresApproval"
          label="Approve registrations manually"
          valuePropName="checked"
          extra="Off: students get their QR as soon as they register."
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="isPublished"
          label="Visible in the app"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
