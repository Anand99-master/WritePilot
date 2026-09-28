import React, { useState } from 'react';
import { Plus, FileText, Search } from 'lucide-react';
import { SearchBar } from '../common/SearchBar';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { PageContainer } from '../common/PageContainer';
import { SavedTextCard } from './SavedTextCard';
import { SavedText } from '../../types';

export interface MyTextPageProps {
  savedTexts: SavedText[];
  onSaveText: (data: { title: string; content: string }, id?: string) => void;
  onDeleteText: (id: string) => void;
}

export const MyTextPage: React.FC<MyTextPageProps> = ({
  savedTexts,
  onSaveText,
  onDeleteText,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavedText | null>(null);

  // Form fields
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [formError, setFormError] = useState('');

  const filteredTexts = savedTexts.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingItem(null);
    setTitleInput('');
    setContentInput('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SavedText) => {
    setEditingItem(item);
    setTitleInput(item.title);
    setContentInput(item.content);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setTitleInput('');
    setContentInput('');
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) {
      setFormError('Please enter a title for the text.');
      return;
    }
    if (!contentInput.trim()) {
      setFormError('Please enter the content to save.');
      return;
    }

    onSaveText(
      {
        title: titleInput.trim(),
        content: contentInput.trim(),
      },
      editingItem ? editingItem.id : undefined
    );

    handleCloseModal();
  };

  return (
    <PageContainer>
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search saved text snippets..."
          className="flex-1 max-w-md"
        />
        <Button
          variant="primary"
          onClick={handleOpenAdd}
          icon={<Plus className="w-4 h-4" />}
        >
          Add New Text
        </Button>
      </div>

      {/* Grid of Saved Texts */}
      {filteredTexts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTexts.map((item) => (
            <SavedTextCard
              key={item.id}
              item={item}
              onEdit={handleOpenEdit}
              onDelete={onDeleteText}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/90 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            {searchQuery ? <Search className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            {searchQuery ? 'No matching texts found' : 'No saved texts yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            {searchQuery
              ? `No snippets match "${searchQuery}". Try a different keyword.`
              : 'Save common messages, templates, or snippets for quick one-click copying.'}
          </p>
          {searchQuery ? (
            <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              icon={<Plus className="w-4 h-4" />}
            >
              Add First Text
            </Button>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingItem ? 'Edit Saved Text' : 'Add New Text'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="text-title" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Title
            </label>
            <input
              id="text-title"
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g. Doctor Invitation, Manager Message"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="text-content" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Content
            </label>
            <textarea
              id="text-content"
              rows={5}
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              placeholder="Type or paste the snippet content here..."
              className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none font-sans leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingItem ? 'Save Changes' : 'Create Text'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
};
