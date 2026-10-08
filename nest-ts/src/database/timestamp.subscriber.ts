import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';

@EventSubscriber()
export class TimestampSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<Record<string, unknown>>): void {
    const now = new Date();
    const entity = event.entity;

    if (!entity) return;

    const created = event.metadata.createDateColumn;
    const updated = event.metadata.updateDateColumn;

    if (created && entity[created.propertyName] == null) entity[created.propertyName] = now;
    if (updated && entity[updated.propertyName] == null) entity[updated.propertyName] = now;
  }

  beforeUpdate(event: UpdateEvent<Record<string, unknown>>): void {
    const updated = event.metadata.updateDateColumn;

    if (event.entity && updated) event.entity[updated.propertyName] = new Date();
  }
}
