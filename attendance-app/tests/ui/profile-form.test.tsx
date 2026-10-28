import {cleanup,fireEvent,render,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {ProfileForm} from "../../components/profile-form";
vi.mock("next-auth/react",()=>({signIn:vi.fn()}));
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe("simplified student registration",()=>{
 it("saves a private email entered once and shows completion",async()=>{
  let submitted:Record<string,unknown>|undefined;
  vi.spyOn(globalThis,"fetch").mockImplementation(async(url,init)=>{
   if(url==="/api/semesters")return response([{id:"semester-one",title:"Mobile"}]);
   if(url==="/api/student/history")return response({profile:null});
   submitted=JSON.parse(String(init?.body));return response({id:"roster-one"});
  });
  const view=render(<ProfileForm beforeClass/>);
  await waitFor(()=>expect(view.getByRole("button",{name:"Aktivizo profilin"}).hasAttribute("disabled")).toBe(false));
  fireEvent.change(view.getByLabelText("Emri",{exact:true}),{target:{value:"Arta"}});
  fireEvent.change(view.getByLabelText("Mbiemri"),{target:{value:"Kola"}});
  fireEvent.change(view.getByLabelText("Student ID"),{target:{value:"REG-1"}});
  fireEvent.change(view.getByLabelText("Grupi i ushtrimeve"),{target:{value:"G1"}});
  fireEvent.change(view.getByLabelText(/emaili/i),{target:{value:"arta.personal@gmail.com"}});
  fireEvent.submit(view.getByRole("form"));
  await waitFor(()=>expect(view.getByRole("status").textContent).toContain("Profili u aktivizua"));
  expect(submitted).toMatchObject({email:"arta.personal@gmail.com",beforeClass:true});
 });
 it("recognizes an existing profile so the student does not register twice",async()=>{
  vi.spyOn(globalThis,"fetch").mockImplementation(async url=>url==="/api/semesters"?response([{id:"semester-one",title:"Mobile"}]):response({profile:{fullName:"Arta Kola",studentId:"REG-1",email:"arta@gmail.com",groupName:"G1"}}));
  const view=render(<ProfileForm beforeClass/>);
  await waitFor(()=>expect(view.getByText(/profili yt është regjistruar/i)).toBeTruthy());
  expect(view.queryByRole("form")).toBeNull();
  expect(view.getByRole("link",{name:/vijueshmërinë/i}).getAttribute("href")).toBe("/student");
 });
});
