import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), staff: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("../../lib/auth/session", async original => ({ ...await original<object>(), getCurrentSession:mocks.session, requireStaff:mocks.staff }));
vi.mock("../../lib/env", () => ({getEnv:()=>({NEXTAUTH_URL:"https://course.example"})}));
vi.mock("next-auth/react", () => ({signIn:mocks.signIn,signOut:mocks.signOut}));
import { AuthorizationError } from "../../lib/auth/session";
import SignInPage from "../../app/signin/page";
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("role-aware OAuth entrance",()=>{
 it("shows professor sign-in and carries the exact selected class to GitHub",async()=>{
  mocks.session.mockResolvedValue(null);
  const target='/staff/qr?week=10&kind=lab&group=G2';
  const view=render(await SignInPage({searchParams:Promise.resolve({callbackUrl:`https://course.example${target}`})}));
  expect(view.getByRole('heading',{name:'Hyrja e profesorit'})).toBeTruthy();
  fireEvent.click(view.getByRole('button',{name:'Hyr me GitHub'}));
  expect(mocks.signIn).toHaveBeenCalledWith('github',{callbackUrl:target});
 });
 it("explains the signed-in student is not the professor, and keeps the destination after sign-out",async()=>{
  mocks.session.mockResolvedValue({user:{name:'Student Test',githubLogin:'student'}});
  mocks.staff.mockRejectedValue(new AuthorizationError('Staff required',403));
  const view=render(await SignInPage({searchParams:Promise.resolve({callbackUrl:'/staff/report?week=7'})}));
  expect(view.getByText(/Kjo llogari nuk ka qasje si profesor/)).toBeTruthy();
  fireEvent.click(view.getByRole('button',{name:'Dil / Ndërro llogarinë'}));
  expect(mocks.signOut).toHaveBeenCalledWith({callbackUrl:'/signin?callbackUrl=%2Fstaff%2Freport%3Fweek%3D7'});
 });
});
