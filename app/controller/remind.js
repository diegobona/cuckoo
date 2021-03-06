'use strict';

const Controller = require('egg').Controller;

class RemindController extends Controller {
  async close() {
    const { ctx, service } = this;
    const { params } = ctx;

    const { id } = params;

    await service.remind.close(id);

    ctx.body = '';
    ctx.status = 204;
  }

  async create() {
    const { ctx, service } = this;
    const { request: { body } } = ctx;

    // TODO: 添加对参数的校验
    const { duration, repeat_type, restricted_hours, timestamp } = body;

    let repeat_id = null;
    if (typeof repeat_type === 'string') {
      repeat_id = (await service.repeat.create({ type: repeat_type })).id;
    }

    const remind = await service.remind.create({
      duration,
      repeat_id,
      restricted_hours,
      timestamp,
    });

    ctx.body = {
      remind,
    };
    ctx.status = 201;
  }

  async get() {
    const { ctx, service } = this;
    const { params } = ctx;

    const { id } = params;

    const remind = await service.remind.get(id);

    ctx.body = {
      remind,
    };
  }

  async update() {
    const { ctx, service } = this;
    const { logger, params, request: { body } } = ctx;

    const { id } = params;
    const changes = {};
    if (body.duration === null || typeof body.duration === 'number') {
      changes.duration = body.duration;
    }
    if (body.restricted_hours === null) {
      changes.restricted_hours = null;
    } else if (Array.isArray(body.restricted_hours)) {
      changes.restricted_hours = body.restricted_hours;
    }
    if (typeof body.timestamp === 'number') {
      changes.timestamp = body.timestamp;
    }

    const remind = await service.remind.get(id);
    if (remind.repeat) {
      if (body.repeat_type === null) {
        changes.repeat = null;
      } else if (typeof body.repeat_type === 'string') {
        remind.repeat.patch({ type: body.repeat_type });
      }
    } else if (typeof body.repeat_type === 'string') {
      changes.repeat = await service.repeat.create({ type: body.repeat_type });
    }
    remind.patch(changes);
    await service.remind.put(remind);

    if (typeof body.timestamp === 'number') {
      const tasks = await service.task.search({
        remind_id: parseInt(id),
      });
      for (const task of tasks) {
        const consumeUntil = body.timestamp;
        await service.queue.send(task.id, consumeUntil);
        logger.info(`设置延时队列中的任务${task.id}在${consumeUntil}后才被消费`);
      }
    }

    ctx.body = '';
    ctx.status = 204;
  }
}

module.exports = RemindController;
