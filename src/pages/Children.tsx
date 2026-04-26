import { useState, useEffect } from 'react';
import { useApp } from '@/lib/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Baby, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  format,
  differenceInMonths,
  differenceInDays,
  parseISO,
  isAfter,
  isBefore,
  startOfDay,
  subYears,
} from 'date-fns';
import { Child } from '@/types';
import { toast } from 'sonner';
import {
  CHILD_AVATAR_OPTIONS,
  getChildAvatar,
  suggestedAvatarIdForGender,
} from '@/lib/childAvatars';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const STANDARD_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

function isStandardBloodGroup(s: string | undefined): s is (typeof STANDARD_BLOOD_GROUPS)[number] {
  return !!s && STANDARD_BLOOD_GROUPS.includes(s as (typeof STANDARD_BLOOD_GROUPS)[number]);
}

/** Dropdown value when editing an existing child (custom types map to `other`). */
function bloodGroupDropdownFromSaved(bg: string | undefined): string | undefined {
  if (!bg?.trim()) return undefined;
  if (isStandardBloodGroup(bg)) return bg;
  return 'other';
}

const emptyChild = (): Partial<Child> => ({
  name: '',
  dateOfBirth: '',
  bloodGroup: '',
  notes: '',
  avatarId: suggestedAvatarIdForGender(undefined),
});

const todayStart = () => startOfDay(new Date());
const minDobStart = () => startOfDay(subYears(new Date(), 30));

export default function Children() {
  const { children, addChild, updateChild, deleteChild, setSelectedChildId } = useApp();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [form, setForm] = useState<Partial<Child>>(emptyChild());
  /** Tracks dropdown selection so "Other" stays selected while the text field is still empty. */
  const [bloodGroupDropdown, setBloodGroupDropdown] = useState<string | undefined>(undefined);
  const [focusedChildId, setFocusedChildId] = useState<string | null>(null);

  useEffect(() => {
    if (focusedChildId && !children.some((c) => c.id === focusedChildId)) {
      setFocusedChildId(null);
    }
  }, [children, focusedChildId]);

  const handleSave = async () => {
    if (!form.name || !form.dateOfBirth || !form.gender) {
      toast.error(t('children.requiredError'));
      return;
    }
    const avatarId =
      form.avatarId?.trim() || suggestedAvatarIdForGender(form.gender);
    const payload = { ...form, avatarId } as Partial<Child>;
    if (editing) {
      updateChild({ ...editing, ...payload } as Child);
      toast.success(t('children.updated'));
    } else {
      const child: Child = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      } as Child;
      const ok = await addChild(child);
      if (!ok) return;
      setSelectedChildId(child.id);
      toast.success(t('children.added'));
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyChild());
  };

  const openEdit = (child: Child) => {
    setEditing(child);
    setForm(child);
    setBloodGroupDropdown(bloodGroupDropdownFromSaved(child.bloodGroup));
    setOpen(true);
  };

  const handleDelete = (child: Child) => {
    if (confirm(t('children.deleteConfirm', { name: child.name }))) {
      deleteChild(child.id);
      setFocusedChildId((id) => (id === child.id ? null : id));
      toast.success(t('children.deleted'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">{t('pages.children.title')}</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setEditing(null);
              setForm(emptyChild());
              setBloodGroupDropdown(undefined);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> {t('children.addChild')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editing ? t('children.editChild') : t('children.addChild')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="child-name">{t('children.form.nameRequired')}</Label>
                <Input
                  id="child-name"
                  autoComplete="name"
                  placeholder={t('children.form.namePlaceholder')}
                  value={form.name || ''}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="child-dob-trigger">{t('children.form.dobRequired')}</Label>
                <DatePicker
                  id="child-dob-trigger"
                  value={form.dateOfBirth || ''}
                  onChange={(v) => setForm((p) => ({ ...p, dateOfBirth: v }))}
                  placeholder={t('children.form.dobPlaceholder')}
                  disabled={(d) =>
                    isAfter(startOfDay(d), todayStart()) || isBefore(startOfDay(d), minDobStart())
                  }
                  defaultMonth={form.dateOfBirth ? parseISO(form.dateOfBirth) : new Date()}
                  fromYear={new Date().getFullYear() - 30}
                  toYear={new Date().getFullYear()}
                />
                {/* <p className="text-xs text-muted-foreground">
                  Use the month and year labels at the top of the calendar to jump quickly. Future dates are disabled.
                </p> */}
              </div>
              <div className="space-y-2">
                <Label htmlFor="child-gender">{t('children.form.genderRequired')}</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => {
                    const g = v as Child['gender'];
                    setForm((p) => ({
                      ...p,
                      gender: g,
                      ...(!editing ? { avatarId: suggestedAvatarIdForGender(g) } : {}),
                    }));
                  }}
                >
                  <SelectTrigger id="child-gender">
                    <SelectValue placeholder={t('children.form.genderPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">{t('children.gender.female')}</SelectItem>
                    <SelectItem value="male">{t('children.gender.male')}</SelectItem>
                    <SelectItem value="other">{t('children.gender.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('children.form.avatar')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('children.form.avatarHint')}
                </p>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label={t('children.form.avatarAria')}
                >
                  {CHILD_AVATAR_OPTIONS.map((opt) => {
                    const selected =
                      (form.avatarId ?? suggestedAvatarIdForGender(form.gender)) === opt.id;
                    const avatarName = t(`children.avatars.${opt.id}`);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={avatarName}
                        aria-pressed={selected}
                        onClick={() => setForm((p) => ({ ...p, avatarId: opt.id }))}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border text-lg transition-colors ${
                          selected
                            ? 'border-primary bg-primary/15 ring-2 ring-primary/30'
                            : 'border-transparent bg-muted/60 hover:bg-muted'
                        }`}
                      >
                        <span aria-hidden>{opt.emoji}</span>
                        <span className="sr-only">{avatarName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="child-blood">{t('children.form.bloodGroup')}</Label>
                <Select
                  value={bloodGroupDropdown}
                  onValueChange={(v) => {
                    setBloodGroupDropdown(v);
                    if (v === 'other') {
                      setForm((p) => ({
                        ...p,
                        bloodGroup: isStandardBloodGroup(p.bloodGroup) ? '' : p.bloodGroup || '',
                      }));
                    } else {
                      setForm((p) => ({ ...p, bloodGroup: v }));
                    }
                  }}
                >
                  <SelectTrigger id="child-blood">
                    <SelectValue placeholder={t('children.form.bloodPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_BLOOD_GROUPS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">{t('children.gender.other')}</SelectItem>
                  </SelectContent>
                </Select>
                {bloodGroupDropdown === 'other' && (
                  <Input
                    id="child-blood-other"
                    className="mt-2"
                    value={form.bloodGroup || ''}
                    onChange={(e) => setForm((p) => ({ ...p, bloodGroup: e.target.value }))}
                    placeholder={t('children.form.bloodOtherPlaceholder')}
                    aria-label={t('children.form.bloodOtherAria')}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="child-notes">{t('children.form.notes')}</Label>
                <Textarea
                  id="child-notes"
                  value={form.notes || ''}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <Button type="button" onClick={() => void handleSave()} className="w-full">
                {editing ? t('common.update') : t('children.addChild')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-20">
          <Baby className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">{t('children.empty')}</p>
        </div>
      ) : (
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(child => {
            const ageMonths = differenceInMonths(new Date(), new Date(child.dateOfBirth));
            const ageDays = differenceInDays(new Date(), new Date(child.dateOfBirth));
            const ageText =
              ageMonths >= 1
                ? t('children.age.months', { count: ageMonths })
                : t('children.age.days', { count: ageDays });
            const avatar = getChildAvatar(child.avatarId);
            const isFocused = focusedChildId === child.id;
            return (
              <Card
                key={child.id}
                className={cn(
                  'hover:shadow-md transition-[box-shadow,transform] duration-200 cursor-pointer',
                  isFocused && 'relative z-10 scale-[1.01] shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
                onClick={() => {
                  setSelectedChildId(child.id);
                  setFocusedChildId((cur) => (cur === child.id ? null : child.id));
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-2xl leading-none"
                      aria-hidden
                    >
                      {avatar ? avatar.emoji : <Baby className="h-6 w-6 text-primary" />}
                    </div>
                    <div>
                      <CardTitle className="font-display">{child.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {ageText} {t('children.ageSuffix')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(child)} aria-label={t('common.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(child)} aria-label={t('common.delete')}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">{t('children.card.dob')}</span>{' '}
                      {format(new Date(child.dateOfBirth), 'PP')}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t('children.card.gender')}</span>{' '}
                      {t(`children.gender.${child.gender}`)}
                    </p>
                    {child.bloodGroup && (
                      <p>
                        <span className="text-muted-foreground">{t('children.card.bloodGroup')}</span>{' '}
                        {child.bloodGroup}
                      </p>
                    )}
                    {child.notes?.trim() && (
                      <p className="pt-1 text-muted-foreground">
                        <span className="font-medium text-foreground/80">{t('children.card.notesLabel')} </span>
                        <span className="block mt-0.5 whitespace-pre-wrap break-words line-clamp-4">{child.notes.trim()}</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
