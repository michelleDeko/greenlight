# frozen_string_literal: true

class AddRecurrenceRuleToRooms < ActiveRecord::Migration[7.2]
  def change
    add_column :rooms, :recurrence_rule, :string
  end
end
