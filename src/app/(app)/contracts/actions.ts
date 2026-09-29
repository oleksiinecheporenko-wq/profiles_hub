"use server";

import { revalidatePath } from "next/cache";
import { failure, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { getRepository } from "@/lib/data";
import type { ContractComment, Timestamp } from "@/lib/domain/types";
import { uuid } from "@/lib/validation/common";
import { contractCommentSchema, contractInputSchema, contractStatusSchema } from "@/lib/validation/contract";

function revalidateContracts(contractId?: string, profileId?: string) {
  revalidatePath("/contracts");
  if (contractId) revalidatePath(`/contracts/${contractId}`);
  if (profileId) revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/profiles");
  revalidatePath("/status-profiles");
  revalidatePath("/actions");
}

export async function createContractAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = contractInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    const contract = await repo.createContract(parsed.data);
    revalidateContracts(contract.id, contract.profileId);
    return ok({ id: contract.id });
  } catch (error) {
    return failure(error);
  }
}

export async function updateContractAction(
  contractId: string,
  input: unknown,
  expectedUpdatedAt: Timestamp,
): Promise<ActionResult<{ id: string }>> {
  const id = uuid.safeParse(contractId);
  if (!id.success) return invalid(id.error);
  const parsed = contractInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    const before = await repo.getContract(id.data);
    const contract = await repo.updateContract(id.data, parsed.data, expectedUpdatedAt);
    revalidateContracts(contract.id, contract.profileId);
    if (before && before.profileId !== contract.profileId) revalidatePath(`/profiles/${before.profileId}`);
    return ok({ id: contract.id });
  } catch (error) {
    return failure(error);
  }
}

export async function setContractStatusAction(contractId: string, status: unknown): Promise<ActionResult> {
  const id = uuid.safeParse(contractId);
  if (!id.success) return invalid(id.error);
  const parsed = contractStatusSchema.safeParse(status);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    const contract = await repo.setContractStatus(id.data, parsed.data);
    revalidateContracts(contract.id, contract.profileId);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteContractAction(contractId: string): Promise<ActionResult> {
  const id = uuid.safeParse(contractId);
  if (!id.success) return invalid(id.error);
  try {
    const repo = await getRepository();
    const existing = await repo.getContract(id.data);
    await repo.softDeleteContract(id.data);
    revalidateContracts(id.data, existing?.profileId);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

export async function addContractCommentAction(contractId: string, body: unknown): Promise<ActionResult<ContractComment>> {
  const id = uuid.safeParse(contractId);
  if (!id.success) return invalid(id.error);
  const parsed = contractCommentSchema.safeParse({ body });
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    // Keep the comment as typed (only the blank check trims).
    const comment = await repo.addContractComment(id.data, typeof body === "string" ? body.replace(/\s+$/, "") : parsed.data.body);
    revalidateContracts(id.data);
    return ok(comment);
  } catch (error) {
    return failure(error);
  }
}
