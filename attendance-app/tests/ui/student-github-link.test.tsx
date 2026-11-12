import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({signIn:vi.fn()}));
vi.mock('next-auth/react',()=>({signIn:auth.signIn}));
import {StudentGitHubLink} from '../../components/student-github-link';
afterEach(()=>{cleanup();vi.restoreAllMocks();auth.signIn.mockReset();});
it('starts OAuth only after a server-created self-link intent; no student ID is supplied by the browser',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({githubLogin:null,repository:null})).mockResolvedValueOnce(Response.json({ready:true}));
 render(<StudentGitHubLink/>);fireEvent.click(screen.getByText('Lidh GitHub-in dhe repository-n tim'));
 const button=screen.getByRole('button',{name:'Lidh GitHub-in tim'});await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false));fireEvent.click(button);
 await waitFor(()=>expect(auth.signIn).toHaveBeenCalledWith('github',{callbackUrl:'/progress?github=linked'}));expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({action:'start'});
});
it('does not redirect to GitHub if the authenticated start is rejected',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({githubLogin:null,repository:null})).mockResolvedValueOnce(Response.json({error:'student_required'},{status:403}));
 render(<StudentGitHubLink/>);fireEvent.click(screen.getByText('Lidh GitHub-in dhe repository-n tim'));const b=screen.getByRole('button',{name:'Lidh GitHub-in tim'});await waitFor(()=>expect(b.hasAttribute('disabled')).toBe(false));fireEvent.click(b);await screen.findByText('Lidhja nuk filloi. Provo përsëri.');expect(auth.signIn).not.toHaveBeenCalled();
});
it('saves a verified repository and explains that the weekly form is still needed',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({githubLogin:'arta',repository:null})).mockResolvedValueOnce(Response.json({repository:'https://github.com/arta/rideshare'}));
 render(<StudentGitHubLink/>);fireEvent.click(screen.getByText('Lidh GitHub-in dhe repository-n tim'));await screen.findByLabelText('Repository i punës');fireEvent.change(screen.getByLabelText('Repository i punës'),{target:{value:'https://github.com/arta/rideshare'}});fireEvent.click(screen.getByRole('button',{name:'Verifiko dhe ruaj repository-n'}));await screen.findByText('Repository u verifikua dhe u ruajt.');expect(screen.getByText(/Ruajtja e këtij linku nuk krijon dorëzim/)).toBeTruthy();
});
