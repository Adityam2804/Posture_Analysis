import React from 'react';
import fs from 'fs';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TableComponent from '../components/UserTable/TableComponent';
import { ProfileProvider } from '../context/ProfileContext';
import MockAdapter from 'axios-mock-adapter';
import { api } from '../api/axios';
import App from '../App';


beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation((msg) => {
        if (
            typeof msg === 'string' &&
            msg.includes('[antd: Spin] `tip` only work in nest or fullscreen pattern.')
        ) return;
        console.error(msg);
    });
});


test('renders UserTable with API data', async () => {
    const mock = new MockAdapter(api);
    mock.onGet(/\/profiles.*/).reply(200, {
        data: [{ firstName: 'Bob', lastName: 'Davis', email: 'bob.davis@example.com' }],
        total: 1,
    });
    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={() => { }} />
        </ProfileProvider>
    );
    await waitForElementToBeRemoved(
        () => document.querySelector('.antd-loader-container'),
        { timeout: 3000 }
    );
    const rows = await screen.findAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
    const nameCell = await screen.findByText(/bob davis/i);
    expect(nameCell).toBeInTheDocument();
});

test('displays empty state when no profiles are returned', async () => {
    const mock = new MockAdapter(api);
    mock.onGet(/\/profiles.*/).reply(200, { data: [], total: 0 });
    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={() => { }} />
        </ProfileProvider>
    );
    await waitForElementToBeRemoved(() =>
        document.querySelector('.antd-loader-container')
    );
    const emptyDiv = document.querySelector('.ant-empty-description');
    expect(emptyDiv).toBeInTheDocument();
});


test('shows UserTable on "Show Table" button click', async () => {
    const mock = new MockAdapter(api);
    mock.onGet(/\/profiles.*/).reply(200, {
        data: [{ firstName: 'Bob', lastName: 'Davis', email: 'bob.davis@example.com' }],
        total: 1,
    });

    render(
        <ProfileProvider>
            <App />
        </ProfileProvider>
    );
    // fs.writeFileSync('test-output1.html', document.body.innerHTML, 'utf8');
    const showTableButton = screen.getByText(/Show Table/i);
    await userEvent.click(showTableButton);
    const tableCell = document.querySelector('.ant-table-cell');
    expect(tableCell).toBeInTheDocument();

});

test('loads next page on pagination click', async () => {
    const mock = new MockAdapter(api);
    mock.onGet(/\/api\/profiles.*/).reply(config => {
        const page = config.params?.page;

        const data = page === 2
            ? [{ firstName: "Jane", lastName: "Smith", email: "jane@example.com" }]
            : [{ firstName: "John", lastName: "Doe", email: "john@example.com" }];

        return [200, { data, total: 10 }];
    });

    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={() => { }} />
        </ProfileProvider>
    );

    await waitFor(() =>
        expect(document.querySelector('.antd-loader-container')).not.toBeInTheDocument()
    );
    const johnCell = await screen.findByText(/john doe/i);
    expect(johnCell).toBeInTheDocument();

    const nextPage = screen.getByText('2');
    await userEvent.click(nextPage);

    await waitFor(() =>
        expect(document.querySelector('.antd-loader-container')).not.toBeInTheDocument()
    );
    const janeCell = await screen.findByText(/jane smith/i);
    expect(janeCell).toBeInTheDocument();
});

test('filters profiles by search term', async () => {
    const mock = new MockAdapter(api);
    mock.onGet(/\/profiles.*/).reply(config => {
        const search = config.params?.search?.toLowerCase();
        let data;

        if (search === 'test') {
            data = [{ firstName: 'Test', lastName: 'User', email: 'test@example.com' }];
        }
        return [200, { data, total: 10 }];
    });
    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={() => { }} />
        </ProfileProvider>
    );
    await waitFor(() =>
        expect(document.querySelector('.antd-loader-container')).not.toBeInTheDocument()
    );
    // fs.writeFileSync('test-output1.html', document.body.innerHTML, 'utf8');
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'test{enter}');
    await waitFor(() =>
        expect(document.querySelector('.antd-loader-container')).not.toBeInTheDocument()
    );

    expect(await screen.findByText(/test user/i)).toBeInTheDocument();
});

test('renders Admin role with correct tag color', async () => {
    const mock = new MockAdapter(api);
    mock.onGet(/\/profiles.*/).reply(200, {
        data: [{ firstName: 'Bob', lastName: 'Davis', email: 'bob.davis@example.com', role: 'Admin' }],
        total: 1,
    });
    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={() => { }} />
        </ProfileProvider>
    );
    await waitFor(() =>
        expect(document.querySelector('.antd-loader-container')).not.toBeInTheDocument()
    );
    fs.writeFileSync('test-tag.html', document.body.innerHTML, 'utf8');
    const tag = screen.getAllByText('Admin')[1];

    // Assert the style directly
    expect(tag).toHaveStyle('background-color: rgb(107, 70, 193)');
});
test('filters profiles by role', async () => {
    const mock = new MockAdapter(api);
    mock.onGet(/\/profiles.*/).reply(config => {
        const role = config.params?.role;
        console.log('role:', role);
        let data;

        if (role === 'Super Admin') {
            data = [{ firstName: 'Alice', lastName: 'Admin', role: 'Super Admin', email: 'alice@example.com' }];
        }
        return [200, { data, total: 1 }];
    });

    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={() => { }} />
        </ProfileProvider>
    );
    await waitFor(() =>
        expect(document.querySelector('.antd-loader-container')).not.toBeInTheDocument()
    );
    fs.writeFileSync('test-output1.html', document.body.innerHTML, 'utf8');
    const buttons = document.querySelectorAll('.role-filter-btn');
    const adminButton = Array.from(buttons).find(btn => btn.textContent?.trim() === 'Super Admin');
    await userEvent.click(adminButton!);
    await waitFor(() =>
        expect(document.querySelector('.antd-loader-container')).not.toBeInTheDocument()
    );

    expect(await screen.findByText(/alice admin/i)).toBeInTheDocument();
});
test('calls onDelete when delete icon is clicked and confirmed', async () => {
    const deleteProfileMock = jest.fn();
    // Mock the API
    const mock = new MockAdapter(api);
    mock.onGet(/\/profiles.*/).reply(200, {
        data: [{ firstName: 'John', lastName: 'Doe', email: 'john@example.com' }],
        total: 1
    });

    // Mock window.confirm to always return true
    jest.spyOn(window, 'confirm').mockImplementation(() => true);
    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={deleteProfileMock} />
        </ProfileProvider>
    );

    await waitForElementToBeRemoved(() => document.querySelector('.antd-loader-container'));

    const deleteIcon = screen.getByTitle('Delete');
    await userEvent.click(deleteIcon);

    expect(window.confirm).toHaveBeenCalledWith('Delete John Doe?');
    expect(deleteProfileMock).toHaveBeenCalled();

    // Clean up the mock
    (window.confirm as jest.Mock).mockRestore();
});

test('calls onEdit when edit icon is clicked', async () => {
    const handleEdit = jest.fn();
    const mock = new MockAdapter(api);
    mock.onGet(/\/profiles.*/).reply(200, {
        data: [{ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }],
        total: 1
    });

    render(
        <ProfileProvider>
            <TableComponent onEdit={handleEdit} onDelete={() => { }} />
        </ProfileProvider>
    );

    await waitForElementToBeRemoved(() => document.querySelector('.ant-spin'));

    const editIcon = screen.getByTitle('Edit');
    await userEvent.click(editIcon);

    expect(handleEdit).toHaveBeenCalled();
});
test('handles reset password modal actions correctly', async () => {
    const mock = new MockAdapter(api);
    window.alert = jest.fn();
    mock.onGet(/\/profiles.*/).reply(200, {
        data: [{ firstName: 'John', lastName: 'Doe', email: 'john@example.com' }],
        total: 1,
    });

    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={() => { }} />
        </ProfileProvider>
    );

    await waitForElementToBeRemoved(() => document.querySelector('.antd-loader-container'));


    const resetIcon = screen.getByTitle('Reset Password');
    await userEvent.click(resetIcon);

    const modalTitle = await screen.findByText(/Reset Password/i);
    expect(modalTitle).toBeInTheDocument();

    const passwordInput = screen.getByPlaceholderText(/Enter new password/i);
    await userEvent.type(passwordInput, 'newSecurePassword123');
    const confirmpasswordInput = screen.getByPlaceholderText(/Confirm password/i);
    await userEvent.type(confirmpasswordInput, 'newSecurePassword123');


    const updateButton = screen.getByRole('button', { name: /Update/i });
    await userEvent.click(updateButton);
    await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await userEvent.click(resetIcon);

    const closeButton = screen.getByText('×');
    await userEvent.click(closeButton);

    expect(screen.queryByText(/Reset Password/i)).not.toBeInTheDocument();
});

test('calls dispatchLoader with FAILURE on fetchProfiles error', async () => {
    const mock = new MockAdapter(api);
    window.alert = jest.fn();

    // Simulate a true error
    mock.onGet(/\/profiles.*/).networkError();

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(
        <ProfileProvider>
            <TableComponent onEdit={() => { }} onDelete={() => { }} />
        </ProfileProvider>
    );

    // Wait until the catch block executes
    await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
            '❌ fetchProfiles failed:',
            expect.any(Error)
        );
    });

    consoleSpy.mockRestore();
});