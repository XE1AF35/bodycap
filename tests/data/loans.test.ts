// The loan repository on fake-indexeddb: lending and giving back, each saved together with the
// item's status, and the rules refusing changes that no longer fit.
import { afterEach, describe, expect, it } from 'vitest'
import { GearNotFoundError, RecordNotFoundError, RuleError } from '@/data/repositories'
import { closeDatabases, current, lens, NOW, openRepositories } from './support'

afterEach(closeDatabases)

const LATER = '2026-10-07T03:00:00.000Z'

async function withLens(status = lens.status) {
  const opened = openRepositories()
  const item = await opened.repos.gear.add({ ...lens, status })
  return { ...opened, item }
}

const details = { borrower: 'Aroha', dateOut: '2026-10-05', dueDate: '2026-10-12' }

describe('loan repository', () => {
  it('lends an item, saving the loan and marking it lent out together as one change', async () => {
    const { repos, item, clock } = await withLens()
    clock.now = LATER
    const loan = await repos.loans.lend(item.id, details)
    expect(loan).toEqual({
      ...details,
      id: '00000000-0000-4000-8000-000000000002',
      gearId: item.id,
      createdAt: LATER,
      updatedAt: LATER,
    })
    expect(await current(repos.gear.get(item.id))).toEqual({
      ...item,
      status: 'lent-out',
      updatedAt: LATER,
    })
    expect(await current(repos.loans.forGear(item.id))).toEqual([loan])
    expect((await current(repos.settings.get())).changesSinceBackup).toBe(2)
  })

  it('refuses to lend an item the rules say cannot be lent, saving nothing', async () => {
    const { repos, item } = await withLens('in-repair')
    await expect(repos.loans.lend(item.id, details)).rejects.toThrow(
      new RuleError("Can't change from in repair to lent out."),
    )
    expect(await current(repos.loans.list())).toEqual([])
    expect((await current(repos.gear.get(item.id)))?.status).toBe('in-repair')
  })

  it('refuses to lend an item that is no longer there', async () => {
    const { repos } = openRepositories()
    await expect(repos.loans.lend('gone', details)).rejects.toThrow(GearNotFoundError)
  })

  it('gives an item back, recording the day and marking it owned again', async () => {
    const { repos, item, clock } = await withLens()
    const loan = await repos.loans.lend(item.id, details)
    clock.now = LATER
    const returned = await repos.loans.giveBack(loan.id, '2026-10-07')
    expect(returned).toEqual({ ...loan, returnedOn: '2026-10-07', updatedAt: LATER })
    expect(await current(repos.gear.get(item.id))).toMatchObject({
      status: 'owned',
      updatedAt: LATER,
    })
  })

  it('records the return of an item lost while lent, leaving it lost', async () => {
    const { repos, item } = await withLens()
    const loan = await repos.loans.lend(item.id, details)
    const lent = await current(repos.gear.get(item.id))
    if (lent === undefined) throw new Error('The item is gone')
    await repos.gear.update(item.id, { ...lent, status: 'lost', lostDate: '2026-10-06' })
    await repos.loans.giveBack(loan.id, '2026-10-07')
    expect((await current(repos.gear.get(item.id)))?.status).toBe('lost')
  })

  it.each([
    ['before it went out', '2026-10-04', "It can't have come back before it went out."],
    ['in the future', '2026-10-08', "The date it came back can't be in the future."],
  ])('refuses a return dated %s, changing nothing', async (_name, returnedOn, message) => {
    const { repos, item } = await withLens()
    const loan = await repos.loans.lend(item.id, details)
    await expect(repos.loans.giveBack(loan.id, returnedOn)).rejects.toThrow(new RuleError(message))
    expect(await current(repos.loans.forGear(item.id))).toEqual([loan])
    expect((await current(repos.gear.get(item.id)))?.status).toBe('lent-out')
  })

  it('refuses to give back a loan that is no longer there', async () => {
    const { repos } = openRepositories()
    await expect(repos.loans.giveBack('gone', '2026-10-07')).rejects.toThrow(RecordNotFoundError)
  })

  it("changes a loan's details, keeping the item and whether it's back", async () => {
    const { repos, item, clock } = await withLens()
    const loan = await repos.loans.lend(item.id, details)
    clock.now = LATER
    const changed = await repos.loans.update(loan.id, { ...details, dueDate: '2026-10-19' })
    expect(changed).toEqual({ ...loan, dueDate: '2026-10-19', updatedAt: LATER })
    await expect(repos.loans.update('gone', details)).rejects.toThrow(RecordNotFoundError)
  })

  it("lists every loan, and each item's own", async () => {
    const { repos, item } = await withLens()
    const other = await repos.gear.add({ ...lens, model: 'FE 85mm F1.8' })
    const first = await repos.loans.lend(item.id, details)
    await repos.loans.giveBack(first.id, '2026-10-06')
    const second = await repos.loans.lend(other.id, { ...details, borrower: 'Sam' })
    expect(await current(repos.loans.forGear(other.id))).toEqual([second])
    expect(await current(repos.loans.list())).toHaveLength(2)
  })

  it('starts the clock for a lend at the time it was asked for', async () => {
    const { repos, item } = await withLens()
    expect((await repos.loans.lend(item.id, details)).createdAt).toBe(NOW)
  })
})
